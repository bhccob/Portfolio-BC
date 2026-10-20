import * as THREE from 'three';
import { palette } from '../palette';
import { buildAnnulus } from './Annulus';
import { DRIVE, TRACKS, headBearing, type TrackId } from './drive';

/**
 * The projects as tracks on the top platter: one signal-yellow ring per
 * project at its radius, four gold test-point pins on each track that has a
 * project, the wider invisible rings that answer the pointer, and the five
 * sectors the Q&A lights. It is one group in the top platter's frame
 * (InstrumentModel.topPlatter), so everything turns with the platter, and
 * everything is in platter-local bearings: a point at bearing b stands at
 * (r sin b, -r cos b) and shows at the dial bearing b - platter.
 *
 * The test points are 90 degrees apart, the first where the read head stands
 * on the track (headBearing), so the platter turned by 90 * k brings pin k
 * under the head. The light is all uniforms: a track's opacity, a pin's
 * emissive and a sector's visibility change nothing a program is built from,
 * so no `set` recompiles.
 */

/** How far the group floats above the platter's face, so no ring lies flush with it. */
export const TRACK_LIFT = 0.001;

/** A test point's pin (radius, height from the face) and how hard the one under the head glows. */
export const PIN = { radius: 0.012, height: 0.02, glow: 1.6 } as const;

/** The Q&A's sectors: the radii they span (SECTOR.inner is clear of the clamp, SECTOR.outer inside the rim) and how bright one lights. */
export const SECTOR = { inner: 0.3, outer: 0.95, opacity: 0.32 } as const;

/** The empty track's dashes round it, and the share of each that is drawn. */
export const DASHES = { count: 24, duty: 0.5 } as const;

/**
 * How lit a track under the pointer is at least (0..1): a dim track comes up to
 * this, one already brighter stays as it is. A track that is dark (nothing lights
 * it) stays dark. Bob's to tune.
 */
export const HOVER_LIT = 0.7;

const DEG = Math.PI / 180;

/** Pins per track that has a project. */
const POINTS = [0, 1, 2, 3] as const;

/** Steps round a ring, a hit ring and a sector (2 degrees each). */
const SEGMENTS = { ring: 256, hit: 128, sector: 36 } as const;

/** A number held to [0, 1]; NaN or an infinity reads as 0, as elsewhere in the instrument. */
function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** A number as a GLSL float. */
function glsl(value: number): string {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

/** What onBeforeCompile hands a patch. */
interface Shader {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
}

/**
 * The empty track's dashes: a basic material for a ring in the dial's XZ
 * plane, with the fragment's bearing read off its local position and every
 * other 1/DASHES.count of a turn cut away (DASHES.duty of each is drawn).
 * Nothing is a uniform, so nothing recompiles.
 */
export function patchDashes(shader: Shader): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTrackPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvTrackPos = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTrackPos;')
    .replace(
      '#include <alphatest_fragment>',
      [
        '#include <alphatest_fragment>',
        `if ( fract( atan( vTrackPos.x, -vTrackPos.z ) / 6.283185307179586 * ${glsl(DASHES.count)} ) >= ${glsl(DASHES.duty)} ) discard;`
      ].join('\n')
    );
}

/** A test point's bearing on the platter: where the head stands on the track, then 90 degrees apart (degrees, platter-local, not wrapped). */
export function tpBearing(track: TrackId, index: number): number {
  return headBearing(DRIVE.tracks[track]) + 90 * index;
}

export interface TracksModel {
  /** Add to instrument.topPlatter(): it sits TRACK_LIFT above the platter's face. */
  group: THREE.Group;
  /** The invisible pick rings, one per track (TRACKS order), each with `userData.track`. They still raycast while the track is dark. */
  hits: THREE.Mesh[];
  /** How lit each track is (0 hides its ring), the test point under the head, and the track under the pointer. */
  set(lit: Record<TrackId, number>, tp: { track: TrackId | null; index: number | null }, hover: TrackId | null): void;
  /** The Q&A's opened question lights one of DRIVE.sectors sectors (sector k centred at bearing 72 * k); null, or no such sector, lights none. */
  setSector(index: number | null): void;
  /** A test point's world position, from fresh matrices; also for the empty track, which has no pin. */
  pointOf(track: TrackId, index: number, target: THREE.Vector3): THREE.Vector3;
  /** Every material, once, for the warm-up. */
  materials(): THREE.Material[];
  dispose(): void;
}

/**
 * A flat sector of a ring, in the dial's XZ plane facing +Y: from bearing
 * `centre - span / 2` to `centre + span / 2` (degrees), between two radii,
 * wound as Annulus winds its ring (counter-clockwise seen from +Y).
 */
function sectorGeometry(inner: number, outer: number, centre: number, span: number, steps: number): THREE.BufferGeometry {
  const columns = steps + 1;
  const positions = new Float32Array(columns * 2 * 3);
  const normals = new Float32Array(columns * 2 * 3);
  const index: number[] = [];
  for (let i = 0; i < columns; i++) {
    const bearing = (centre - span / 2 + (span * i) / steps) * DEG;
    const sin = Math.sin(bearing);
    const cos = Math.cos(bearing);
    positions.set([inner * sin, 0, -inner * cos, outer * sin, 0, -outer * cos], i * 6);
    normals.set([0, 1, 0, 0, 1, 0], i * 6);
    if (i < steps) {
      const a = i * 2;
      const b = a + 2;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

export function buildTracks(): TracksModel {
  const group = new THREE.Group();
  group.name = 'tracks';
  group.position.y = TRACK_LIFT;

  // Signal yellow, added to what is under it. Created transparent, so light never flags a program.
  const glowing = (name: string, opacity: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({ name, color: palette.yellow, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  // One material per track: each is lit on its own.
  const ringMaterials = {} as Record<TrackId, THREE.MeshBasicMaterial>;
  const rings = {} as Record<TrackId, THREE.Mesh>;
  for (const id of TRACKS) {
    const material = glowing(`tracks:${id}`, 0);
    if (id === 'next') {
      material.onBeforeCompile = (shader) => patchDashes(shader);
      material.customProgramCacheKey = () => 'tracks:dashed';
    }
    const half = DRIVE.trackWidth / 2;
    const ring = buildAnnulus({ inner: DRIVE.tracks[id] - half, outer: DRIVE.tracks[id] + half, segments: SEGMENTS.ring, uv: 'polar', material }).mesh;
    ring.name = `tracks:ring-${id}`;
    ring.userData.track = id;
    ring.visible = false;
    ringMaterials[id] = material;
    rings[id] = ring;
    group.add(ring);
  }

  // The pick rings: three's raycaster tests a mesh whether it is visible or not, so these stay `visible` and draw nothing,
  // their material switched off (the renderer skips it) and, were it ever drawn, writing neither colour nor depth.
  const hitMaterial = new THREE.MeshBasicMaterial({ name: 'tracks:hit', visible: false, transparent: true, colorWrite: false, depthWrite: false });
  const hits = TRACKS.map((id) => {
    const half = DRIVE.hitWidth / 2;
    const hit = buildAnnulus({ inner: DRIVE.tracks[id] - half, outer: DRIVE.tracks[id] + half, segments: SEGMENTS.hit, uv: 'polar', material: hitMaterial }).mesh;
    hit.name = `tracks:hit-${id}`;
    hit.userData.track = id;
    group.add(hit);
    return hit;
  });

  // The Q&A's sectors: one shared material, as only one is ever lit.
  const sectorMaterial = glowing('tracks:sector', SECTOR.opacity);
  const span = 360 / DRIVE.sectors;
  const sectors = Array.from({ length: DRIVE.sectors }, (_, k) => {
    const sector = new THREE.Mesh(sectorGeometry(SECTOR.inner, SECTOR.outer, span * k, span, SEGMENTS.sector), sectorMaterial);
    sector.name = `tracks:sector-${k}`;
    sector.userData.sector = k;
    sector.visible = false;
    group.add(sector);
    return sector;
  });

  // The test points: gold pins whose foot reaches the platter's face, under the group's lift. Only the empty track has none.
  const pinGeometry = new THREE.CylinderGeometry(PIN.radius, PIN.radius, PIN.height, 16).translate(0, PIN.height / 2 - TRACK_LIFT, 0);
  const pinPosition = (track: TrackId, index: number, target: THREE.Vector3): THREE.Vector3 => {
    const radius = DRIVE.tracks[track];
    const bearing = tpBearing(track, index) * DEG;
    return target.set(radius * Math.sin(bearing), 0, -radius * Math.cos(bearing));
  };
  const pins: { track: TrackId; index: number; material: THREE.MeshStandardMaterial }[] = [];
  for (const id of TRACKS) {
    if (id === 'next') continue;
    for (const k of POINTS) {
      // Gold as the coil is; aglow by its emissive alone.
      const material = new THREE.MeshStandardMaterial({
        name: `tracks:pin-${id}-${k}`,
        color: palette.gold,
        metalness: 0.6,
        roughness: 0.35,
        emissive: palette.yellow,
        emissiveIntensity: 0
      });
      const pin = new THREE.Mesh(pinGeometry, material);
      pin.name = `tracks:pin-${id}-${k}`;
      pin.userData = { track: id, index: k };
      pinPosition(id, k, pin.position);
      group.add(pin);
      pins.push({ track: id, index: k, material });
    }
  }

  const materials = (): THREE.Material[] =>
    Array.from(new Set<THREE.Material>([...TRACKS.map((id) => ringMaterials[id]), hitMaterial, sectorMaterial, ...pins.map((pin) => pin.material)]));

  const set: TracksModel['set'] = (lit, tp, hover) => {
    for (const id of TRACKS) {
      const light = unit(lit[id]);
      const opacity = hover === id && light > 0 ? Math.max(light, HOVER_LIT) : light;
      ringMaterials[id].opacity = opacity;
      rings[id].visible = opacity > 0;
    }
    for (const pin of pins) pin.material.emissiveIntensity = tp.track === pin.track && tp.index === pin.index ? PIN.glow : 0;
  };

  const setSector: TracksModel['setSector'] = (index) => {
    const lit = index !== null && Number.isInteger(index) && index >= 0 && index < sectors.length ? index : -1;
    sectors.forEach((sector, k) => {
      sector.visible = k === lit;
    });
  };

  const pointOf: TracksModel['pointOf'] = (track, index, target) => {
    group.updateWorldMatrix(true, false);
    return pinPosition(track, index, target).applyMatrix4(group.matrixWorld);
  };

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) geometries.add(mesh.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials().forEach((material) => material.dispose());
    group.removeFromParent();
  };

  return { group, hits, set, setSector, pointOf, materials, dispose };
}
