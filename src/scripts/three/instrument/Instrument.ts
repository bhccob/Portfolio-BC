import * as THREE from 'three';
import { DIAL, type HomeId } from './dialSpec';
import { buildAnnulus, type Annulus } from './Annulus';
import { buildBasePlate } from './BasePlate';
import { buildNeedle } from './Needle';
import { buildPool } from './Pool';
import { applyTextures, createMaterials, createPlaceholders, SWEEP } from './materials';
import type { InstrumentTextures } from './textures';

/**
 * The compass: a luopan in dark lacquer and gilt on a square base plate, its
 * needle glowing over the heaven pool, red threads across it. Built DOM-free
 * with plain materials (the unit tests run it in node); the painted face,
 * the ring strips and the image textures are swapped in as they arrive.
 *
 * root (the scene leans and tips it) → mount (turns the face to the camera,
 * rotation.x = π/2) → spin (the free turn, rotation.y) → the plate and the
 * dial. The dial's frame is the face's: its parts lie in its XZ plane with
 * the face at y = 0 and its normal +Y, north −Z and east +X (dialSpec).
 */

export interface InstrumentPose {
  /** Radians, clockwise from north. */
  bearing: number;
  /** 0 at rest on the pin, 1 lifted 0.05 and faded to 0.15. */
  lift: number;
  /** The portrait's opacity in the pool (once one has arrived). */
  portrait: number;
  /** The threads' opacity. */
  threads: number;
}

export type RingId = 'trigram' | 'direction' | 'degree' | 'pattern';

export interface InstrumentModel {
  /** The scene leans and tips this. */
  root: THREE.Group;
  /** rotation.x = π/2, fixed: the face toward +Z, north up. */
  mount: THREE.Group;
  /** rotation.y = the free turn. */
  spin: THREE.Group;
  /** The face's frame, for pointer bearings. */
  dial: THREE.Object3D;
  rings: Record<RingId, Annulus>;
  needle: THREE.Group;
  applyPose(pose: InstrumentPose): void;
  /** The pattern ring sweeping from one home's strip to another's, spreading both ways from originDeg. */
  setPattern(from: HomeId, to: HomeId, sweep: number, originDeg: number): void;
  /** The painted strips; a home left out shows the plain placeholder. */
  setStrips(strips: Partial<Record<HomeId, THREE.Texture>>): void;
  /** The painted face and its roughness/metalness map. */
  setFace(color: THREE.Texture, mr: THREE.Texture): void;
  /** Safe to call more than once; a texture left out keeps whatever is there. */
  setTextures(textures: InstrumentTextures): void;
  /** Clearcoat on the lacquer and the pattern ring, or off (a cheaper program). */
  setClearcoat(on: boolean): void;
  /** Every material, once, for the warm-up. */
  materials(): THREE.Material[];
  /** Frees the geometries, materials and placeholders it made; the textures handed to it stay the caller's. */
  dispose(): void;
}

/** The brass rim: a low bead from the pattern ring's edge out to DIAL.rim, its outer edge on the face. */
const RIM = { height: 0.01, steps: 12, segments: 256 } as const;

/** The lacquer bed under the rings, just below the face, so no sliver between a ring and a rule shows through. */
const BED_DEPTH = 0.003;

/** The gilt rules' tubes: sides round the tube and steps round the dial. */
const RULE = { sides: 8, segments: 256 } as const;

const REST: InstrumentPose = { bearing: 0, lift: 0, portrait: 0, threads: 1 };

/** A number clamped to [0, 1]; NaN or an infinity reads as 0, as in sweepCoverage. */
function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Degrees as a share of a turn in [0, 1); NaN reads as 0. */
function turn(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const t = degrees / 360 - Math.floor(degrees / 360);
  return t >= 1 ? 0 : t;
}

function rimGeometry(): THREE.LatheGeometry {
  const inner = DIAL.rings.pattern[1];
  const middle = (inner + DIAL.rim) / 2;
  const half = (DIAL.rim - inner) / 2;
  // From the outer edge in, so the lathe faces the bead up and out.
  const points = Array.from({ length: RIM.steps + 1 }, (_, k) => {
    const a = (k / RIM.steps) * Math.PI;
    return new THREE.Vector2(middle + half * Math.cos(a), k === 0 || k === RIM.steps ? 0 : RIM.height * Math.sin(a));
  });
  return new THREE.LatheGeometry(points, RIM.segments);
}

export function buildInstrument(): InstrumentModel {
  const placeholders = createPlaceholders();
  const { materials: m, patternUniforms } = createMaterials(placeholders);

  const root = new THREE.Group();
  root.name = 'compass';
  const mount = new THREE.Group();
  mount.name = 'compass:mount';
  mount.rotation.x = Math.PI / 2;
  const spin = new THREE.Group();
  spin.name = 'compass:spin';
  const dial = new THREE.Group();
  dial.name = 'compass:dial';
  root.add(mount);
  mount.add(spin);
  spin.add(buildBasePlate(m), dial);

  // The four rings: the face's three, planar over the painted face, and the pattern ring, polar.
  const ring = (id: RingId, material: THREE.Material): Annulus => {
    const [inner, outer] = DIAL.rings[id];
    const annulus = buildAnnulus({ inner, outer, uv: id === 'pattern' ? 'polar' : 'planar' });
    annulus.mesh.material = material;
    annulus.mesh.name = `compass:ring-${id}`;
    dial.add(annulus.mesh);
    return annulus;
  };
  const rings: Record<RingId, Annulus> = {
    trigram: ring('trigram', m.face),
    direction: ring('direction', m.face),
    degree: ring('degree', m.face),
    pattern: ring('pattern', m.pattern)
  };

  const bed = buildAnnulus({ inner: DIAL.pool, outer: DIAL.rings.pattern[1], uv: 'planar', segments: 128 });
  bed.mesh.material = m.lacquer;
  bed.mesh.position.y = -BED_DEPTH;
  bed.mesh.name = 'compass:bed';
  dial.add(bed.mesh);

  // The raised gilt rules: half-round beads standing on the face.
  for (const r of DIAL.rules) {
    const rule = new THREE.Mesh(new THREE.TorusGeometry(r, DIAL.ruleWidth / 2, RULE.sides, RULE.segments).rotateX(Math.PI / 2), m.gilt);
    rule.name = `compass:rule-${r}`;
    dial.add(rule);
  }

  const rim = new THREE.Mesh(rimGeometry(), m.brass);
  rim.name = 'compass:rim';
  dial.add(rim);

  const pool = buildPool(m);
  dial.add(pool.object);

  const needle = buildNeedle(m);
  dial.add(needle.group, needle.pin);

  // The red threads, north-south and east-west, plate edge to plate edge.
  const threads = new THREE.Group();
  threads.name = 'compass:threads';
  threads.position.y = DIAL.threads.height;
  const threadGeometry = new THREE.CylinderGeometry(DIAL.threads.radius, DIAL.threads.radius, DIAL.plate, 8, 1, true).rotateX(Math.PI / 2);
  const northSouth = new THREE.Mesh(threadGeometry, m.threads);
  northSouth.name = 'compass:thread-ns';
  const eastWest = new THREE.Mesh(threadGeometry, m.threads);
  eastWest.name = 'compass:thread-ew';
  eastWest.rotation.y = Math.PI / 2;
  threads.add(northSouth, eastWest);
  dial.add(threads);

  let disposed = false;
  let hasPortrait = false;
  let portraitShown = 0;
  let strips: Partial<Record<HomeId, THREE.Texture>> = {};
  let pattern: { from: HomeId; to: HomeId; sweep: number; originDeg: number } = { from: 'plain', to: 'plain', sweep: 0, originDeg: 0 };

  const showPortrait = (): void => {
    m.portrait.opacity = portraitShown;
    pool.portrait.visible = hasPortrait && portraitShown > 0;
  };

  const showPattern = (): void => {
    // Swapping one texture for another changes no program, so nothing is flagged.
    m.pattern.map = strips[pattern.from] ?? placeholders.strip;
    patternUniforms.mapTo.value = strips[pattern.to] ?? placeholders.strip;
    patternUniforms.uSweep.value = unit(pattern.sweep);
    patternUniforms.uOrigin.value = turn(pattern.originDeg);
    patternUniforms.uSoft.value = SWEEP.soft;
  };

  const applyPose = (pose: InstrumentPose): void => {
    needle.pose(Number.isFinite(pose.bearing) ? pose.bearing : 0, unit(pose.lift));
    portraitShown = unit(pose.portrait);
    showPortrait();
    const shown = unit(pose.threads);
    m.threads.opacity = shown;
    northSouth.visible = eastWest.visible = shown > 0;
  };

  const setPattern = (from: HomeId, to: HomeId, sweep: number, originDeg: number): void => {
    pattern = { from, to, sweep, originDeg };
    showPattern();
  };

  const setStrips = (next: Partial<Record<HomeId, THREE.Texture>>): void => {
    if (disposed) return;
    strips = { ...next };
    showPattern();
  };

  const setFace = (color: THREE.Texture, mr: THREE.Texture): void => {
    if (disposed) return;
    m.face.map = color;
    m.face.roughnessMap = mr;
    m.face.metalnessMap = mr;
  };

  const setTextures = (textures: InstrumentTextures): void => {
    if (disposed) return;
    applyTextures(m, textures);
    if (textures.portrait) {
      m.portrait.map = textures.portrait;
      hasPortrait = true;
      showPortrait();
    }
  };

  const setClearcoat = (on: boolean): void => {
    // three flags the program itself when clearcoat crosses zero.
    for (const material of [m.lacquer, m.plate, m.pattern]) material.clearcoat = on ? 1 : 0;
  };

  const materials = (): THREE.Material[] => Array.from(new Set<THREE.Material>(Object.values(m)));

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) geometries.add(mesh.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials().forEach((material) => material.dispose());
    Object.values(placeholders).forEach((texture) => texture.dispose());
    root.removeFromParent();
  };

  applyPose(REST);
  showPattern();

  return {
    root,
    mount,
    spin,
    dial,
    rings,
    needle: needle.group,
    applyPose,
    setPattern,
    setStrips,
    setFace,
    setTextures,
    setClearcoat,
    materials,
    dispose
  };
}
