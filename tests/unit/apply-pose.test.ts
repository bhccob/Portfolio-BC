import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { applyPose, carryProgress, freeTurnLocked, tracksShown } from '../../src/scripts/three/applyPose';
import { compassPoseAt, locate, nominalSpans, poseAt, SECTIONS, spansFromOffsets, type CompassPose } from '../../src/scripts/three/Choreography';
import { TRACKS, type TrackId } from '../../src/scripts/three/instrument/drive';
import { buildInstrument, type InstrumentModel } from '../../src/scripts/three/instrument/Instrument';
import { buildTracks, PIN, type TracksModel } from '../../src/scripts/three/instrument/Tracks';
import { buildWire, type WireModel } from '../../src/scripts/three/instrument/Wire';

const DEG = Math.PI / 180;
const LOCALS = [0, 0.5, 1] as const;

/** Every section at its start, middle and end, top to bottom. */
const POSES: CompassPose[] = SECTIONS.flatMap(({ id }) => LOCALS.map((local) => poseAt(id, local)));

interface Rig {
  model: InstrumentModel;
  wire: WireModel;
  tracks: TracksModel;
}

/** The instrument with the wire in its dial's frame and the tracks on its top platter, as the scene builds them. */
function rig(): Rig {
  const model = buildInstrument();
  const wire = buildWire();
  const tracks = buildTracks();
  model.dial.add(wire.mesh);
  model.topPlatter().add(tracks.group);
  return { model, wire, tracks };
}

/** The scripted needle, in radians, as the scene would steer it with no pearl. */
const needleOf = (pose: CompassPose): number => pose.needle.bearing * DEG;

const pose = (r: Rig, p: CompassPose, hover: TrackId | null = null): void => applyPose(r.model, r.wire, r.tracks, p, needleOf(p), hover);

const named = (root: THREE.Object3D, name: string): THREE.Mesh => {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`no ${name}`);
  return found as THREE.Mesh;
};
const ringOf = (r: Rig, id: TrackId): THREE.Mesh => named(r.tracks.group, `tracks:ring-${id}`);
const opacityOf = (mesh: THREE.Mesh): number => (mesh.material as THREE.MeshBasicMaterial).opacity;
const unit = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const allMaterials = (r: Rig): THREE.Material[] => [...r.model.materials(), ...r.wire.materials(), ...r.tracks.materials()];

describe('applyPose', () => {
  it('poses every section at its start, middle and end with finite transforms and geometry', () => {
    const r = rig();
    for (const p of POSES) {
      pose(r, p);
      r.model.root.updateMatrixWorld(true);
      r.model.root.traverse((object) => {
        for (const value of object.matrixWorld.elements) expect(Number.isFinite(value), `${object.name} at ${p.section} ${p.local}`).toBe(true);
      });
      for (const value of r.wire.mesh.geometry.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("lays the wire from the arm's tail and direction (coilAnchor) on every pose", () => {
    const r = rig();
    const set = vi.spyOn(r.wire, 'set');
    const reference = buildWire();
    for (const p of POSES) {
      pose(r, p);
      const coil = r.model.coilAnchor();
      const [given, anchor, axis] = set.mock.calls[set.mock.calls.length - 1];
      expect(given).toEqual(p.wire);
      expect(anchor).toEqual(coil.anchor);
      expect(axis).toEqual(coil.axis);
      // The tube is the one a wire laid with those values has, winding round the coil where the pose winds it.
      reference.set(p.wire, coil.anchor, coil.axis);
      expect(Array.from(r.wire.mesh.geometry.getAttribute('position').array)).toEqual(Array.from(reference.mesh.geometry.getAttribute('position').array));
      expect(r.wire.mesh.visible).toBe(p.wire.show > 0);
    }
  });

  it('turns the needle into the arm and the platter by exactly the pose', () => {
    const r = rig();
    for (const p of POSES) {
      pose(r, p);
      // No spin of its own is added: the mirror's wipe is platter-local and needs the pose's whole turns.
      expect(r.model.platter.rotation.y).toBeCloseTo(p.platter * DEG, 12);
    }
    pose(r, poseAt('hero', 0.5));
    expect(r.model.needle.rotation.y).toBeCloseTo(-needleOf(poseAt('hero', 0.5)), 12);
  });

  it('lights the tracks, their test points and the group as the pose says', () => {
    const r = rig();
    for (const p of POSES) {
      pose(r, p);
      for (const id of TRACKS) {
        const ring = ringOf(r, id);
        expect(opacityOf(ring), `${id} at ${p.section} ${p.local}`).toBeCloseTo(unit(p.tracks.lit[id]), 12);
        expect(ring.visible).toBe(unit(p.tracks.lit[id]) > 0);
      }
      r.tracks.group.traverse((object) => {
        if (!object.name.startsWith('tracks:pin-')) return;
        const { track, index } = object.userData as { track: TrackId; index: number };
        const glow = ((object as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity;
        expect(glow).toBe(track === p.tracks.current && index === p.tracks.tp ? PIN.glow : 0);
      });
      expect(r.tracks.group.visible).toBe(tracksShown(p));
    }
    // Hidden while the compass is a compass (the pins ignore the light), shown once the drive has formed.
    pose(r, poseAt('hero', 0.5));
    expect(r.tracks.group.visible).toBe(false);
    pose(r, poseAt('change', 0.5));
    expect(r.tracks.group.visible).toBe(false);
    pose(r, poseAt('funcial', 0.3));
    expect(r.tracks.group.visible).toBe(true);
    const glowing = named(r.tracks.group, 'tracks:pin-funcial-0').material as THREE.MeshStandardMaterial;
    expect(glowing.emissiveIntensity).toBe(PIN.glow);
  });

  it('brightens the hovered track only while the pose answers the pointer', () => {
    const r = rig();
    const tracksPose = poseAt('funcial', 0.5);
    expect(tracksPose.interactive).toBe(true);
    pose(r, tracksPose, 'jontai-energy');
    expect(opacityOf(ringOf(r, 'jontai-energy'))).toBeCloseTo(Math.min(1, tracksPose.tracks.lit['jontai-energy'] * 1.2), 12);
    expect(opacityOf(ringOf(r, 'cookies-clicker'))).toBeCloseTo(tracksPose.tracks.lit['cookies-clicker'], 12);
    const parked = poseAt('offduty', 0.5);
    expect(parked.interactive).toBe(false);
    pose(r, parked, 'jontai-energy');
    expect(opacityOf(ringOf(r, 'jontai-energy'))).toBeCloseTo(parked.tracks.lit['jontai-energy'], 12);
  });

  it('changes no material version (no recompile) after the first call, through every pose and back', () => {
    const r = rig();
    pose(r, POSES[0]);
    const versions = new Map(allMaterials(r).map((material) => [material, material.version]));
    for (const p of [...POSES, ...[...POSES].reverse()]) pose(r, p, p.interactive ? 'funcial' : null);
    for (let k = 0; k <= 200; k++) pose(r, compassPoseAt(k / 200));
    versions.forEach((version, material) => expect(material.version, material.name).toBe(version));
  });
});

describe('the free turn while the needle becomes the arm', () => {
  it('is held strictly between the needle and the arm, and free at either end', () => {
    expect(freeTurnLocked(0)).toBe(false);
    expect(freeTurnLocked(1)).toBe(false);
    for (const arm of [1e-6, 0.3, 0.5, 0.999999]) expect(freeTurnLocked(arm)).toBe(true);
    expect(freeTurnLocked(Number.NaN)).toBe(false);
  });

  it('is held in the change and the fold back, where the arm moves, and nowhere else', () => {
    const held = new Set(
      Array.from({ length: 401 }, (_, k) => compassPoseAt(k / 400))
        .filter((p) => freeTurnLocked(p.drive.arm))
        .map((p) => p.section)
    );
    expect([...held].sort()).toEqual(['change', 'hello']);
    expect(freeTurnLocked(poseAt('change', 0.55).drive.arm)).toBe(true);
    expect(freeTurnLocked(poseAt('hello', 0.3).drive.arm)).toBe(true);
    expect(freeTurnLocked(poseAt('funcial', 0.5).drive.arm)).toBe(false);
    expect(freeTurnLocked(poseAt('hero', 0.5).drive.arm)).toBe(false);
  });
});

describe('the tracks group', () => {
  it('shows once the platters have grown, or while any track is lit', () => {
    expect(tracksShown(poseAt('hero', 1))).toBe(false);
    expect(tracksShown(poseAt('change', 0.7))).toBe(false);
    expect(tracksShown(poseAt('change', 0.76))).toBe(true);
    expect(tracksShown(poseAt('qa', 0.5))).toBe(true);
    expect(tracksShown(poseAt('hello', 0.2))).toBe(true);
    expect(tracksShown(poseAt('hello', 0.5))).toBe(false);
  });
});

describe('carrying the progress to new spans', () => {
  // The Q&A measured twice its nominal height: everything after it moves down the scroll.
  const tall = nominalSpans(200);
  const nominal = nominalSpans();

  it('keeps the section and how far through it', () => {
    for (let k = 0; k <= 100; k++) {
      const progress = k / 100;
      const was = locate(progress, nominal);
      const now = locate(carryProgress(progress, nominal, tall), tall);
      expect(now.id).toBe(was.id);
      expect(now.local).toBeCloseTo(was.local, 9);
    }
  });

  it('keeps both ends and stays in 0..1', () => {
    expect(carryProgress(0, nominal, tall)).toBe(0);
    expect(carryProgress(1, nominal, tall)).toBeCloseTo(1, 12);
    const measured = spansFromOffsets(nominal.map(({ id, start }) => ({ id, top: start * 900 })), 900);
    for (const progress of [0, 0.37, 0.81, 1]) {
      const carried = carryProgress(progress, measured, tall);
      expect(carried).toBeGreaterThanOrEqual(0);
      expect(carried).toBeLessThanOrEqual(1);
    }
  });

  it('leaves the progress where the new spans lack its section', () => {
    expect(carryProgress(0.5, nominal, [])).toBe(0.5);
  });
});
