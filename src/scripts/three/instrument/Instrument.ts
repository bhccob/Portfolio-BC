import * as THREE from 'three';
import { DIAL, type HomeId } from './dialSpec';
import { DRIVE } from './drive';
import { buildAnnulus, type Annulus } from './Annulus';
import { buildBasePlate, HOLE_RADIUS } from './BasePlate';
import { buildDriveParts, CLAMP_HEIGHT, HUB_TOP, type PlatterId } from './DriveParts';
import { armState, buildNeedle, type ArmState } from './Needle';
import { buildPool } from './Pool';
import { applyTextures, createMaterials, createPlaceholders, SWEEP } from './materials';
import type { InstrumentTextures } from './textures';
import { WIRE } from './wirePath';

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
 *
 * The same object turns into a hard drive as the pose's `drive` runs from 0
 * to 1: the degree, direction and pattern rings grow into three platters
 * that slide apart in depth and wipe to mirror (they sit in `platter`, which
 * turns), the trigram ring closes into the clamp, the pool into the hub, the
 * needle becomes the arm (Needle, armState) and the plate the chassis. Every
 * value gives a whole, finite pose, and no pose recompiles a program.
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
  /** How far each part has turned into the hard drive's: 0 the compass … 1 the drive (the choreography's `drive`). */
  drive: { stack: number; mirror: number; grow: number; clamp: number; arm: number; chassis: number };
  /** The read head's radius from the centre, once the arm has formed. */
  head: number;
  /** 0 the head on its track … 1 parked on the ramp. */
  park: number;
  /** The platters' turn, degrees, counter-clockwise as seen. */
  platter: number;
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
  /** Inside `dial`, turned by the pose's `platter` (rotation.y = platter in radians: a point at bearing 0 shows at −platter); it carries the platters and, on the top one, the tracks. */
  platter: THREE.Group;
  /** The frame the tracks sit in: on the top platter's face, turning with it. */
  topPlatter(): THREE.Object3D;
  /**
   * Dial-local: where the coil is wound, its middle on the tail half its length (WIRE.coil.length) in from the tail's end
   * (the arm's, or the needle's as the compass), and the arm's direction toward the head, a unit vector.
   */
  coilAnchor(): { anchor: [number, number, number]; axis: [number, number, number] };
  /** The read head's (the needle tip's) world position, written into `target`. */
  headWorld(target: THREE.Vector3): THREE.Vector3;
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

/** The drive folded away, the compass as it is: for a pose that carries no drive. */
export const FOLDED_DRIVE: Readonly<Pick<InstrumentPose, 'drive' | 'head' | 'park' | 'platter'>> = Object.freeze({
  drive: Object.freeze({ stack: 0, mirror: 0, grow: 0, clamp: 0, arm: 0, chassis: 0 }),
  head: DRIVE.tracks.funcial,
  park: 0,
  platter: 0
});

/** The brass rim: a low bead from the pattern ring's edge out to DIAL.rim, its outer edge on the face. */
const RIM = { height: 0.01, steps: 12, segments: 256 } as const;

/**
 * The lacquer bed under the rings, just below the face, so no sliver between a
 * ring and a rule shows through. As the drive's floor it sinks below the
 * bottom platter and reaches out under the plate's wall, where the rim was.
 */
const BED = { depth: 0.003, sunk: -3 * DRIVE.platter.gap - 0.01, reach: HOLE_RADIUS + 0.01 } as const;

/** The gilt rules' tubes: sides round the tube and steps round the dial. */
const RULE = { sides: 8, segments: 256 } as const;

/** Each platter's height at stack 1: the top one (the pattern ring) rises, the others sink a gap apart. */
const PLATTER_Y: Record<PlatterId, number> = { pattern: DRIVE.platter.rise, direction: -DRIVE.platter.gap, degree: -2 * DRIVE.platter.gap };

const DEG = Math.PI / 180;

const REST: InstrumentPose = { bearing: 0, lift: 0, portrait: 0, threads: 1, ...FOLDED_DRIVE };

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
  const { materials: m, uniforms } = createMaterials(placeholders);

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
  const base = buildBasePlate(m);
  spin.add(base.object, dial);

  // The platters' frame, and the top platter's within it (the pattern ring and, later, the tracks).
  const platter = new THREE.Group();
  platter.name = 'compass:platter';
  const top = new THREE.Group();
  top.name = 'compass:platter-top';
  platter.add(top);
  dial.add(platter);

  // The four rings: the face's three, planar over the painted face, and the pattern ring, polar.
  const ring = (id: RingId, material: THREE.Material, parent: THREE.Object3D): Annulus => {
    const [inner, outer] = DIAL.rings[id];
    const annulus = buildAnnulus({ inner, outer, uv: id === 'pattern' ? 'polar' : 'planar', material });
    annulus.mesh.name = `compass:ring-${id}`;
    parent.add(annulus.mesh);
    return annulus;
  };
  const rings: Record<RingId, Annulus> = {
    trigram: ring('trigram', m.face, dial),
    direction: ring('direction', m.face, platter),
    degree: ring('degree', m.face, platter),
    pattern: ring('pattern', m.pattern, top)
  };
  const platterIds: PlatterId[] = ['pattern', 'direction', 'degree'];

  const bed = buildAnnulus({ inner: DIAL.pool, outer: DIAL.rings.pattern[1], uv: 'planar', segments: 128, material: m.lacquer });
  bed.mesh.position.y = -BED.depth;
  bed.mesh.name = 'compass:bed';
  dial.add(bed.mesh);

  // The raised gilt rules: half-round beads standing on the face.
  const rules = DIAL.rules.map((r) => {
    const rule = new THREE.Mesh(new THREE.TorusGeometry(r, DIAL.ruleWidth / 2, RULE.sides, RULE.segments).rotateX(Math.PI / 2), m.gilt);
    rule.name = `compass:rule-${r}`;
    dial.add(rule);
    return rule;
  });

  const rim = new THREE.Mesh(rimGeometry(), m.rim);
  rim.name = 'compass:rim';
  dial.add(rim);

  const pool = buildPool(m);
  dial.add(pool.object);

  const needle = buildNeedle(m, uniforms);
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

  // The drive's own parts: each platter's edge under its ring, the hub on the axis, the clamp's band round it and its
  // screws on the turning platter, the magnets, the ramp and the cover screws on the chassis.
  const parts = buildDriveParts(m);
  for (const id of platterIds) rings[id].mesh.add(parts.edges[id]);
  dial.add(parts.hub, parts.clampBand, parts.magnets, parts.ramp, parts.screws);
  platter.add(parts.clampScrews);

  let disposed = false;
  let hasPortrait = false;
  let portraitShown = 0;
  let strips: Partial<Record<HomeId, THREE.Texture>> = {};
  let pattern: { from: HomeId; to: HomeId; sweep: number; originDeg: number } = { from: 'plain', to: 'plain', sweep: 0, originDeg: 0 };
  let arm: ArmState = armState(0, 0, 0, FOLDED_DRIVE.head, 0);
  // Each ring's radii as last laid, so an unchanged pose rewrites no geometry.
  const laid = new Map<Annulus, [number, number]>();

  const showPortrait = (): void => {
    m.portrait.opacity = portraitShown;
    pool.portrait.visible = hasPortrait && portraitShown > 0;
  };

  const showPattern = (): void => {
    // Swapping one texture for another changes no program, so nothing is flagged.
    m.pattern.map = strips[pattern.from] ?? placeholders.strip;
    uniforms.pattern.mapTo.value = strips[pattern.to] ?? placeholders.strip;
    uniforms.pattern.uSweep.value = unit(pattern.sweep);
    uniforms.pattern.uOrigin.value = turn(pattern.originDeg);
    uniforms.pattern.uSoft.value = SWEEP.soft;
  };

  const setRadii = (annulus: Annulus, inner: number, outer: number): void => {
    const was = laid.get(annulus);
    if (was && was[0] === inner && was[1] === outer) return;
    annulus.setRadii(inner, outer);
    laid.set(annulus, [inner, outer]);
  };

  /** The rings, the bed, the clamp and the hub, the fades and the chassis for the drive's six values. */
  const poseDrive = (drive: InstrumentPose['drive'], threadsShown: number): void => {
    const stack = unit(drive.stack);
    const mirror = unit(drive.mirror);
    const grow = unit(drive.grow);
    const clamp = unit(drive.clamp);
    const chassis = unit(drive.chassis);

    // The platters: apart in depth with stack, out to full discs with grow, wiped to mirror.
    const outer = {} as Record<PlatterId, number>;
    for (const id of platterIds) {
      const [inner, out] = DIAL.rings[id];
      outer[id] = lerp(out, DRIVE.platter.outer, grow);
      setRadii(rings[id], lerp(inner, DRIVE.platter.inner, grow), outer[id]);
      (id === 'pattern' ? top : rings[id].mesh).position.y = PLATTER_Y[id] * stack;
    }
    parts.setEdges(outer, grow);
    uniforms.mirror.uMirror.value = mirror;
    const bedY = lerp(-BED.depth, BED.sunk, stack);
    bed.mesh.position.y = bedY;
    setRadii(bed, DIAL.pool, lerp(DIAL.rings.pattern[1], BED.reach, stack));

    // The gilt rules, the rim and the threads go as the mirror comes.
    m.gilt.opacity = m.rim.opacity = 1 - mirror;
    for (const rule of rules) rule.visible = mirror < 1;
    rim.visible = mirror < 1;
    m.threads.opacity = threadsShown * (1 - mirror);
    northSouth.visible = eastWest.visible = m.threads.opacity > 0;

    // The trigram ring closes into the clamp above the top platter, a steel band under its edge down to the platter and
    // its screws coming in; the pool closes in round the rising hub.
    const clampOuter = lerp(DIAL.rings.trigram[1], DRIVE.clamp[1], clamp);
    setRadii(rings.trigram, lerp(DIAL.rings.trigram[0], DRIVE.clamp[0], clamp), clampOuter);
    rings.trigram.mesh.position.y = CLAMP_HEIGHT * clamp;
    parts.setClamp(clampOuter, PLATTER_Y.pattern * stack, CLAMP_HEIGHT * clamp, clamp);
    pool.pose(clamp);
    // Its top starts just under the pool's floor, so it never lies flush with it.
    parts.setHub(bedY, lerp(-DIAL.poolDepth - 0.002, HUB_TOP, clamp));

    // The aluminium fades in over the lacquer plate, which goes once it is covered.
    m.aluminium.opacity = chassis;
    base.chassis.visible = chassis > 0;
    base.plate.visible = chassis < 1;
    parts.setChassis(chassis);
  };

  const applyPose = (pose: InstrumentPose): void => {
    const lift = unit(pose.lift);
    const drive = pose.drive;
    arm = armState(pose.bearing, lift, unit(drive.arm), pose.head, pose.park);
    needle.pose(arm, lift);
    platter.rotation.y = Number.isFinite(pose.platter) ? pose.platter * DEG : 0;
    portraitShown = unit(pose.portrait);
    showPortrait();
    poseDrive(drive, unit(pose.threads));
  };

  const coilAnchor = (): { anchor: [number, number, number]; axis: [number, number, number] } => {
    const x = Math.sin(arm.bearing);
    const z = -Math.cos(arm.bearing);
    // Half the coil's length in from the tail's end, so the coil is wound wholly on the tail: its far end is the tail's
    // end, and on the drive it stays on the chassis, between the magnets.
    const back = arm.tail - WIRE.coil.length / 2;
    return { anchor: [arm.x - back * x, arm.y, arm.z - back * z], axis: [x, 0, z] };
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
    platter,
    topPlatter: () => top,
    coilAnchor,
    headWorld: needle.headWorld,
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
