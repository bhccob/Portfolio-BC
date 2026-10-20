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
 * grain of ± `grain` (one value per 1/`grainRings` of radius), and the soft
 * edge of the wipe, the pattern sweep's own (sweepCoverage).
 */
export const MIRROR = { color: 0xc9ccd6, roughness: 0.12, grain: 0.04, grainRings: 600, soft: 0.015 } as const;

/** Steel: the platters' edges, the hub, and the arm once it has formed. */
export const STEEL = { color: 0xb4b8c0, roughness: 0.3 } as const;

/** The chassis: brushed aluminium, a neutral metal (its image is tinted to this). */
export const ALUMINIUM = { color: 0x9da1a8, roughness: 0.45 } as const;

/**
 * The actuator's two magnet blocks, near-black metal: their size (long side
 * north-south, then height, then across), and how far each stands east or
 * west of the pivot, clear of the arm and its coil.
 */
export const MAGNET = { size: [0.18, 0.05, 0.12], apart: 0.13, color: palette.boardDeep, metalness: 0.8, roughness: 0.35 } as const;

/** The park ramp: across the arm, its height (just under the parked head's slider), and along the arm. */
export const RAMP = { size: [0.05, 0.03, 0.1] } as const;

/** How thick a platter shows at its edge. */
export const PLATTER_EDGE = 0.012;

/** The clamp's height above the face: just above the top platter. */
export const CLAMP_HEIGHT = DRIVE.platter.rise + 0.015;

/** The top of the hub, a little proud of the clamp. */
export const HUB_TOP = CLAMP_HEIGHT + 0.008;

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

/** A hex colour, linear, as a GLSL vec3. */
function vec3(hex: number): string {
  const color = new THREE.Color(hex);
  return `vec3( ${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)} )`;
}

/** What onBeforeCompile hands a patch. */
interface Shader {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
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
 * grained by radius, and no clear coat. At uMirror 0 nothing changes.
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
        // Each fine ring of the turning a little rougher or smoother than the next.
        `  float grain = fract( sin( floor( length( vDialPos.xz ) * ${glsl(MIRROR.grainRings)} ) * 12.9898 ) * 43758.5453 );`,
        `  diffuseColor.rgb = mix( diffuseColor.rgb, ${vec3(MIRROR.color)}, mirrorCover );`,
        '  metalnessFactor = mix( metalnessFactor, 1.0, mirrorCover );',
        `  roughnessFactor = mix( roughnessFactor, ${glsl(MIRROR.roughness)} + ${glsl(MIRROR.grain)} * ( 2.0 * grain - 1.0 ), mirrorCover );`,
        '}'
      ].join('\n')
    )
    .replace(
      '#include <lights_physical_fragment>',
      ['#include <lights_physical_fragment>', '#ifdef USE_CLEARCOAT', '\tmaterial.clearcoat *= 1.0 - mirrorCover;', '#endif'].join('\n')
    );
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
}

export interface DriveParts {
  /** The steel band under each platter's outer edge, to be added to its ring's mesh. */
  edges: Record<PlatterId, THREE.Mesh>;
  /** The spindle's hub: a steel post on the dial's axis. */
  hub: THREE.Mesh;
  /** The actuator's magnets, round the arm's pivot on the chassis. */
  magnets: THREE.Group;
  /** The ramp the head parks on, at the platter's edge. */
  ramp: THREE.Mesh;
  /** Each edge as wide as its ring's outer radius and PLATTER_EDGE * `grow` deep; hidden at grow 0. */
  setEdges(outer: Record<PlatterId, number>, grow: number): void;
  /** The hub from `bottom` up to `top`, hidden while it has no height. */
  setHub(bottom: number, top: number): void;
  /** The magnets and the ramp, scaled in from nothing with the chassis. */
  setChassis(chassis: number): void;
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

  // Each block stands on the chassis (its foot at y 0) with its long side north-south.
  const [long, tall, across] = MAGNET.size;
  const block = new THREE.BoxGeometry(long, tall, across).translate(0, tall / 2, 0);
  const magnets = new THREE.Group();
  magnets.name = 'compass:magnets';
  magnets.position.set(DRIVE.pivot[0], 0, DRIVE.pivot[1]);
  for (const side of [-1, 1]) {
    const magnet = new THREE.Mesh(block, m.magnet);
    magnet.name = `compass:magnet-${side < 0 ? 'west' : 'east'}`;
    magnet.rotation.y = Math.PI / 2;
    magnet.position.x = side * MAGNET.apart;
    magnets.add(magnet);
  }
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

  return {
    edges,
    hub,
    magnets,
    ramp,
    setEdges(outer, grow) {
      for (const id of Object.keys(edges) as PlatterId[]) {
        edges[id].scale.set(outer[id], grow, outer[id]);
        edges[id].visible = grow > 0;
      }
    },
    setHub(bottom, top) {
      const height = top - bottom;
      hub.visible = height > 1e-4;
      hub.position.y = bottom;
      hub.scale.y = Math.max(height, 1e-4);
    },
    setChassis(chassis) {
      magnets.visible = ramp.visible = chassis > 0;
      // Never quite zero, so no matrix is singular while they are hidden.
      const scale = Math.max(chassis, 1e-4);
      magnets.scale.setScalar(scale);
      ramp.scale.setScalar(scale);
    }
  };
}
