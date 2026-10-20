import * as THREE from 'three';
import { DIAL } from './dialSpec';
import { DRIVE, armBearing } from './drive';
import { READ_HEAD, STEEL } from './DriveParts';
import type { InstrumentMaterials, InstrumentUniforms } from './materials';

/**
 * The needle: a slender lozenge, diamond in section, its tip half signal
 * yellow and glowing, its tail half brass, built pointing at −Z (north) and
 * turned about its pin by `rotation.y = −bearing`, which puts the tip at
 * (sin b, −cos b) as the dial frame has it. It rests at y 0.05 on a brass pin
 * standing up from the pool's floor; `lift` raises it by up to 0.05 and fades
 * both halves and the pin to 0.15, uncovering the pool.
 *
 * In the change to the hard drive it becomes the read/write arm (armState):
 * the group's origin is always the pivot, and the halves stretch along the
 * blade, so the tip's point is always the read head.
 */

/** The needle's centre above the face, how far a full lift raises it, and how faint it is then. */
export const NEEDLE = { y: 0.05, lift: 0.05, faded: 0.15 } as const;

/**
 * The arm's three overlapping phases over the pose's `drive.arm` (each eased
 * in and out): the blade slides on its pivot, the pivot hops to the drive's
 * corner, the blade turns onto its track and settles.
 */
export const ARM_PHASES = { slide: [0, 0.4], travel: [0.3, 0.8], turn: [0.7, 1] } as const;

/**
 * The arm's shape once formed, as the pivot travels: the tip half widens to
 * `width` times the needle's across (a flat blade broad at the pivot and
 * tapering to the head, a drive's actuator arm) and flattens to `height`
 * times its depth; the hub over the pivot grows `hub` times round, the
 * pivot's bearing. The tail stays as narrow as it was, inside the coil.
 */
export const ARM_SHAPE = { width: 3.2, height: 0.25, hub: 1.5 } as const;

/** Where the needle (or the arm) is, in the dial's frame. */
export interface ArmState {
  /** The pivot. */
  x: number;
  y: number;
  z: number;
  /** Radians clockwise from north: where the tip points. */
  bearing: number;
  /** The blade's length ahead of the pivot (to the tip, the head) and behind it (to the tail). */
  tip: number;
  tail: number;
  /** How far the pivot is on its way to the corner, eased: 0 on the pin … 1 landed. */
  travel: number;
}

const DEG = Math.PI / 180;

/** The distances from the centre the arm's head can reach, a hair inside its limits. */
const REACH = (() => {
  const pivot = Math.hypot(DRIVE.pivot[0], DRIVE.pivot[1]);
  return [Math.abs(pivot - DRIVE.armLength) + 1e-6, pivot + DRIVE.armLength - 1e-6] as const;
})();

/** A number held to [0, 1]; NaN or an infinity reads as 0. */
function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Hermite ease from 0 at `a` to 1 at `b`, flat at both ends. */
function smooth([a, b]: readonly [number, number], x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** An angle wrapped into [−π, π). */
function wrapPi(angle: number): number {
  return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}

/**
 * The arm's bearing (radians) that puts the head on `head`, or, with `park`
 * toward 1, on the park ramp at DRIVE.parkRadius. A radius out of the arm's
 * reach reads as the nearest it can reach, and NaN as the first track.
 */
export function armTarget(head: number, park: number): number {
  const track = Number.isFinite(head) ? head : DRIVE.tracks.funcial;
  const radius = track + (DRIVE.parkRadius - track) * unit(park);
  return (armBearing(Math.min(REACH[1], Math.max(REACH[0], radius))) ?? 0) * DEG;
}

/**
 * The needle, or the arm it becomes, for a pose: the needle's `bearing`
 * (radians) and `lift`, and the drive's `arm` (0 the needle … 1 the arm),
 * `head` (the head's radius) and `park`. A pure function; unsound input reads
 * as sound (NaN as 0, out of range held to it).
 *
 *   - slide (arm 0–0.4): the pivot stays on the pin while the tail shortens
 *     from DIAL.needle.tail to DRIVE.yoke and the tip side grows from
 *     DIAL.needle.tip to DRIVE.armLength;
 *   - travel (0.3–0.8): the pivot moves from the centre to DRIVE.pivot, from
 *     the needle's height to DRIVE.armHeight, hopping up to DRIVE.travelLift
 *     halfway so it clears the rings; it lands at the arm's height, and only
 *     comes down after the top of the hop;
 *   - turn (0.7–1): the blade turns from the needle's bearing (the short way)
 *     to the arm's onto its track or ramp.
 *
 * At arm 0 it is exactly the needle: on the pin at NEEDLE.y plus its lift,
 * along `bearing`, at its own lengths.
 */
export function armState(bearing: number, lift: number, arm: number, head: number, park: number): ArmState {
  const needle = Number.isFinite(bearing) ? bearing : 0;
  const t = unit(arm);
  const slide = smooth(ARM_PHASES.slide, t);
  const travel = smooth(ARM_PHASES.travel, t);
  const turn = smooth(ARM_PHASES.turn, t);
  const rest = NEEDLE.y + NEEDLE.lift * unit(lift);
  // The height the pivot travels at, the needle's to the arm's, and the hop over it toward travelLift.
  const base = rest + (DRIVE.armHeight - rest) * travel;
  return {
    x: DRIVE.pivot[0] * travel,
    y: base + 4 * travel * (1 - travel) * (DRIVE.travelLift - base),
    z: DRIVE.pivot[1] * travel,
    bearing: needle + wrapPi(armTarget(head, park) - needle) * turn,
    tip: DIAL.needle.tip + (DRIVE.armLength - DIAL.needle.tip) * slide,
    tail: DIAL.needle.tail + (DRIVE.yoke - DIAL.needle.tail) * slide,
    travel
  };
}

export interface Needle {
  /** Turns with the bearing and lifts; holds the two halves and the hub; its origin is the pivot. */
  group: THREE.Group;
  /** The pin it turns on, from the pool's floor up to the needle at rest; it neither turns nor lifts, but fades with the needle, and as the pivot leaves it. */
  pin: THREE.Mesh;
  /** Poses it as `state` says (armState), faded by `lift`. */
  pose(state: ArmState, lift: number): void;
  /** The tip's point, the read head, in world space. */
  headWorld(target: THREE.Vector3): THREE.Vector3;
}

/**
 * One half of the lozenge: four flat faces from the apex at `z` to the
 * diamond round the pin (half-width w, half-height h), wound to face out.
 */
function half(z: number, w: number, h: number): THREE.BufferGeometry {
  const apex = [0, 0, z];
  const right = [w, 0, 0];
  const up = [0, h, 0];
  const left = [-w, 0, 0];
  const down = [0, -h, 0];
  // Round the diamond; the tail half takes each pair the other way round, so both halves' faces look outward.
  const ring = [up, right, down, left];
  const faces: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 4];
    faces.push(...apex, ...(z < 0 ? a : b), ...(z < 0 ? b : a));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildNeedle(m: InstrumentMaterials, uniforms: InstrumentUniforms): Needle {
  const { tip, tail, width, height, pin: pinRadius } = DIAL.needle;
  const group = new THREE.Group();
  group.name = 'compass:needle';

  const tipHalf = new THREE.Mesh(half(-tip, width / 2, height / 2), m.needleTip);
  tipHalf.name = 'compass:needle-tip';
  const tailHalf = new THREE.Mesh(half(tail, width / 2, height / 2), m.needleTail);
  tailHalf.name = 'compass:needle-tail';
  // The hub over the pin, a little proud of the lozenge, in the tail's brass so it fades with the needle.
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, height + 0.004, 32), m.needleTail);
  hub.name = 'compass:needle-hub';
  group.add(tipHalf, tailHalf, hub);

  // The read head's slider: in the tip half's frame, centred on the tip's point (so the blade's steel never reaches
  // it, patchBlade), and as long there as it will be once the half has stretched to the arm's length.
  const [across, tall, along] = READ_HEAD.size;
  const slider = new THREE.Mesh(
    new THREE.BoxGeometry(across, tall, (along * tip) / DRIVE.armLength).translate(0, READ_HEAD.top - tall / 2, -tip),
    m.needleTip
  );
  slider.name = 'compass:read-head';
  slider.visible = false;
  tipHalf.add(slider);

  const pinHeight = NEEDLE.y + DIAL.poolDepth;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius * 0.6, pinRadius * 0.6, pinHeight, 16), m.pin);
  pin.position.y = NEEDLE.y - pinHeight / 2;
  pin.name = 'compass:pin';

  // The tail's brass, as made, and the steel it turns to as the arm forms.
  const brass = { color: m.needleTail.color.clone(), metalness: m.needleTail.metalness, roughness: m.needleTail.roughness };
  const steel = new THREE.Color(STEEL.color);
  const apex = new THREE.Vector3();

  const pose = (state: ArmState, lift: number): void => {
    group.position.set(state.x, state.y, state.z);
    group.rotation.y = -state.bearing;
    // The blade broadens and flattens into the arm as the pivot travels (exactly the needle's at travel 0).
    const across = 1 + (ARM_SHAPE.width - 1) * state.travel;
    const deep = 1 + (ARM_SHAPE.height - 1) * state.travel;
    tipHalf.scale.set(across, deep, state.tip / tip);
    tailHalf.scale.z = state.tail / tail;
    const round = 1 + (ARM_SHAPE.hub - 1) * state.travel;
    hub.scale.set(round, 1, round);

    const opacity = 1 + (NEEDLE.faded - 1) * lift;
    m.needleTip.opacity = opacity;
    m.needleTail.opacity = opacity;
    // The pin stays on the dial's axis: it fades as the pivot leaves it.
    m.pin.opacity = opacity * (1 - state.travel);
    pin.visible = m.pin.opacity > 0;

    // In flight the blade turns to steel but for its head, and the tail and hub with it; the head's slider grows in.
    uniforms.blade.uSteel.value = state.travel;
    uniforms.blade.uHeadFrom.value = 1 - READ_HEAD.glow / state.tip;
    slider.visible = state.travel > 0;
    // Its own size whatever the blade's breadth and depth round it.
    const grown = Math.max(state.travel, 1e-4);
    slider.scale.set(grown / across, grown / deep, 1);
    m.needleTail.color.lerpColors(brass.color, steel, state.travel);
    m.needleTail.metalness = brass.metalness + (1 - brass.metalness) * state.travel;
    m.needleTail.roughness = brass.roughness + (STEEL.roughness - brass.roughness) * state.travel;
  };
  pose(armState(0, 0, 0, DRIVE.tracks.funcial, 0), 0);

  const headWorld = (target: THREE.Vector3): THREE.Vector3 => {
    tipHalf.updateWorldMatrix(true, false);
    return target.copy(tipHalf.localToWorld(apex.set(0, 0, -tip)));
  };

  return { group, pin, pose, headWorld };
}
